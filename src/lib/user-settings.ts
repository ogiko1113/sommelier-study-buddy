// User-configurable settings stored in localStorage (per-browser).
// Keys are namespaced so they don't collide with other state.

const EXAM_DATE_KEY = "wm:exam_date"; // YYYY-MM-DD (JST)
const DAILY_GOAL_KEY = "wm:daily_goal"; // integer

export const DEFAULT_EXAM_DATE = "2026-07-15";
export const DEFAULT_DAILY_GOAL = 50;

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function getExamDateKey(): string {
  const v = safeGet(EXAM_DATE_KEY);
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return DEFAULT_EXAM_DATE;
}

export function setExamDateKey(key: string) {
  safeSet(EXAM_DATE_KEY, key);
}

export function getDailyGoal(): number {
  const v = safeGet(DAILY_GOAL_KEY);
  const n = v ? parseInt(v, 10) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 9999) return n;
  return DEFAULT_DAILY_GOAL;
}

export function setDailyGoal(n: number) {
  safeSet(DAILY_GOAL_KEY, String(n));
}
