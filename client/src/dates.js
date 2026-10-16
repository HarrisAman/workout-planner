// Dates are plain "YYYY-MM-DD" strings everywhere to avoid timezone bugs.
const pad = (n) => String(n).padStart(2, '0');
export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => fmt(addDays(start, i)));
export const today = () => fmt(new Date());

export function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

export const shortDay = (s) => parse(s).toLocaleDateString(undefined, { weekday: 'short' });
export const monthDay = (s) => parse(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
export const dayNum = (s) => parse(s).getDate();
