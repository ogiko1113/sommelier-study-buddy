
Implementation plan for `src/routes/_authenticated.index.tsx` — all 6 dashboard metrics, isolated to this single file.

## Constants & helpers (top of file)

```ts
const EXAM_DATE = new Date('2026-07-15T00:00:00+09:00');
const DAILY_GOAL = 50;

// JST day-key YYYY-MM-DD
function jstDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
}

// JST midnight → UTC Date for a YYYY-MM-DD key
function jstMidnightUtc(key: string): Date {
  return new Date(`${key}T00:00:00+09:00`);
}

// Add N days using setDate (handles month/year rollover) — per user note #1
function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + n);
  return next;
}

function daysUntilExam(): number { /* JST diff */ }
function computeStreak(keys: Set<string>): number { /* per spec edge case */ }
```

## Data fetches (parallel useEffects)

1. **Today's count** — `answer_logs` count, head:true, between today's JST midnight UTC and tomorrow's (computed via `addDays(jstMidnightUtc(todayKey), 1)`).
2. **Streak + 7-day trend** — single query: `answer_logs.select('answered_at, is_correct').gte('answered_at', addDays(jstMidnightUtc(todayKey), -60).toISOString())` (per user note #2, 60-day range anchored to JST midnight). Client buckets by `jstDateKey(new Date(answered_at))`.
3. **Single questions fetch** — `questions.select('category, subcategory, difficulty, correct_count, wrong_count').eq('is_archived', false)`. Derive client-side:
   - Category aggregates (replaces `category_stats` view fetch)
   - Subcategory map for フランス/イタリア
   - Difficulty aggregates (1/2/3)
   - Uncovered counts per category
4. **Existing**: SRS due count + tag_stats — unchanged.

## UI sections (top → bottom)

1. **Exam countdown** — `text-4xl` number, `border-primary/40 bg-primary/5`. Three states: `試験まで N 日` / `試験当日です` / `試験お疲れさまでした`.
2. 本日の復習 — unchanged.
3. Action buttons — unchanged.
4. **本日の学習 + 連続日数** — 2-col grid card. Left: `本日 N問 / 目標 50問` + progress bar (`min(N/50,1)*100%`). Right: `N日連続` with 🔥 if ≥7.
5. **7-day accuracy trend** — Recharts `LineChart` h=180, X-axis short labels (`M/D`), Y-axis `[0,100]`, `connectNulls={false}`, tooltip `{v}%`. Empty-state if all null.
6. **Category accuracy (with drill-down)** — フランス/イタリア rows become `<button>` toggling a local `Set<string>` of expanded categories; expanded state renders subcategory rows indented `ml-4` as `<Link to="/quiz/setup" search={{ category, subcategory }}>`. Chevron `▶`/`▼`. Other categories stay as flat `<Link>`. Reuse `rateColorClass`.
7. Tag accuracy — unchanged.
8. **難易度別正答率** — 3 rows (★ / ★★ / ★★★) with accuracy %, n=X, same color coding.
9. **未解答の問題** — rows `カテゴリ: 残り X問 / 全 Y問` + thin coverage progress bar `(total - uncovered) / total`. Filter `uncovered > 0`, sort desc by uncovered.

## Loading / error

Each section independently: `読み込み中…` while `null`, inline `text-destructive` on error. Same pattern as existing blocks.

## Notes

- `category_stats` view fetch removed from this page (replaced by single questions aggregate). View itself untouched.
- All JST arithmetic uses `setDate()` (user note #1) and 60-day range anchored at JST midnight (user note #2).
- Streak edge case: if today's key missing but yesterday's present, count backward from yesterday.
- No new files, no new deps, no schema changes.
