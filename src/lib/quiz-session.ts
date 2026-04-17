// sessionStorage helpers for active quiz / SRS sessions

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
}

export interface ActiveQuiz {
  questionIds: string[];
  currentIndex: number;
  answers: AnswerRecord[];
  mode: "quiz";
  startedAt: string;
}

export interface ActiveSrs {
  questionIds: string[];
  currentIndex: number;
  answers: AnswerRecord[];
  mode: "srs_review";
  startedAt: string;
}

const QUIZ_KEY = "wine-master:active-quiz";
const SRS_KEY = "wine-master:active-srs";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function clear(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(key);
}

export const quizSession = {
  load: () => read<ActiveQuiz>(QUIZ_KEY),
  save: (s: ActiveQuiz) => write(QUIZ_KEY, s),
  clear: () => clear(QUIZ_KEY),
};

export const srsSession = {
  load: () => read<ActiveSrs>(SRS_KEY),
  save: (s: ActiveSrs) => write(SRS_KEY, s),
  clear: () => clear(SRS_KEY),
};
