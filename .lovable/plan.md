
Both fixes are isolated to `src/routes/_authenticated.quiz.setup.tsx`. No other files need changes — `/quiz/run` already branches on `question_type` for all three types, and SRS uses its own setup/run flow.

## Changes to `_authenticated.quiz.setup.tsx`

**1. Add question_type state**
- New state: `questionType: "multiple_choice" | "fill_blank" | "flashcard"`, default `"multiple_choice"`.

**2. Add 問題形式 UI block**
- Place above 難易度 (so users pick type first, then narrow by difficulty/tags).
- Three buttons in a flex row, mirroring the existing 難易度 button style (h-12, flex-1, same active/inactive border + bg classes).
- Labels: クイズ / 穴埋め / カード.

**3. Extend the Supabase query**
- Add `.eq("question_type", questionType)` to the `questions` fetch chain.

**4. Change count options from `[1, 10]` to `[1, 10, 20]`**
- Update the `count` state type to `1 | 10 | 20`.
- Update the `.map([1, 10, 20])` array.
- Buttons stay flex-1 so three fit cleanly side-by-side.

**5. Untouched**
- Category, subcategory, difficulty, tags, order logic.
- Session save shape (`quizSession.save`) — `question_type` doesn't need to be persisted in the session; the run screen reads it from each question row.
- `/cards/setup`, `/srs/run`, `/quiz/run` — no edits.

## Notes
- Default `multiple_choice` preserves current UX exactly: existing users hitting 開始 get the same result as today (since the current query without a type filter likely returned mixed types — this is actually a small behavioral tightening, but matches the user's stated intent).
- No new imports required.
