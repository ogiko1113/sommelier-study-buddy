

## SRS Review Mode — Alignment Plan

The app already has `/srs/run`, `/srs/summary`, and an SRS button. They mostly work but diverge from the spec in several places. This plan brings them into spec without touching the quiz mode.

### 1. Home screen (`src/routes/_authenticated.index.tsx`)

Replace the current due-count query (which OR's in starred questions) with the strict spec query:

```ts
supabase.from("questions")
  .select("id", { count: "exact", head: true })
  .not("next_review_at", "is", null)
  .lte("next_review_at", new Date().toISOString())
  .lt("srs_stage", 5);
```

Update the SRS card copy and the SRS button:
- Card: "本日の復習" + count + "問が復習待ち" (drop "+ スター付き")
- When `dueCount === 0`: show grayed button labeled "本日の復習なし" (spec: "No reviews due today")
- When `dueCount > 0`: button shows "SRS復習を始める" with the count as a small badge

### 2. SRS run screen (`src/routes/_authenticated.srs.run.tsx`)

Rewrite the queue-building effect to match the spec exactly:

```ts
supabase.from("questions")
  .select("id")
  .not("next_review_at", "is", null)
  .lte("next_review_at", new Date().toISOString())
  .lt("srs_stage", 5)
  .order("next_review_at", { ascending: true })
  .limit(20);
```

Drop the starred-fallback logic. If queue is empty, navigate back to `/`.

In `onRate`:
- **`is_correct` in `answer_logs`**: change to `rating === "perfect"` (spec rule), not `selected === answer_index`. Keep `selected_index` and `selected_text` so UI feedback still has data.
- Keep using `applySrsRating` from `src/lib/srs.ts` for the question update.

Track which answers were `vague` or `unknown` in the session so the summary can list them. Extend `AnswerRecord` (or the SRS-only session shape) to include the rating:

```ts
export interface SrsAnswerRecord extends AnswerRecord {
  rating: SrsRating;
}
```

Persist `rating` on each push into `session.answers`.

### 3. SRS interval helper (`src/lib/srs.ts`)

Fix one edge case to match the spec's `else now() + interval '3 days'` branch:
- For `rating === "vague"` when `currentStage >= 5` (mastered), reschedule at 3 days instead of 30 days. Implementation: replace `SRS_INTERVALS_DAYS[Math.min(stage, 4)]` with a clamp that defaults to 3 days when stage is out of range.

No other changes — the perfect/unknown branches already match.

### 4. SRS summary screen (`src/routes/_authenticated.srs.summary.tsx`)

Rebuild to mirror the quiz summary layout:
- Score block: `{perfectCount} / {total}` where perfect counts as correct (per spec: "count Perfect as correct, others as incorrect"). Subtitle shows "Perfect: N / Vague: N / Unknown: N".
- Below: list of questions rated **Vague** or **Unknown** — fetch their `question_text` via `.in("id", reviewIds)`.
- Single "ホームへ戻る" button that clears `srsSession` and navigates `/`.

### Files

| File | Action |
|---|---|
| `src/routes/_authenticated.index.tsx` | edit — fix due-count query, SRS button copy/disabled state |
| `src/routes/_authenticated.srs.run.tsx` | edit — fix queue query (strict, limit 20), fix `is_correct`, store rating per answer |
| `src/routes/_authenticated.srs.summary.tsx` | edit — score-out-of-N + Vague/Unknown list + home button |
| `src/lib/srs.ts` | edit — vague branch fallback to 3 days when stage ≥ 5 |
| `src/lib/quiz-session.ts` | edit — extend `ActiveSrs.answers` to carry `rating: SrsRating` (keeps quiz session untouched) |

### Out of scope (per spec)
- Pause/resume mid-session
- Listing mastered (stage 5) questions
- Customizable intervals

### Risk / non-regressions
- Quiz mode files (`_authenticated.quiz.*`) are not touched.
- `applySrsRating` keeps the same signature; only the vague-at-mastered fallback changes.
- `AnswerRecord` stays unchanged; SRS-only fields go on `ActiveSrs.answers` via a separate `SrsAnswerRecord` shape, so quiz session storage is unaffected.

