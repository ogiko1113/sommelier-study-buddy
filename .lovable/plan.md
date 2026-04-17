## Tag-Based Cross-Cutting Drill — Plan

### 1. New route: `/drill` → `src/routes/_authenticated.drill.tsx`

Tag selection screen mirroring quiz/setup styling.

**UI:**

- Header: "タグ横断演習" (Tag Drill) + back link to `/`
- Tag chips section: 8 tags from `src/constants/tags.ts` rendered as toggle chips (reuse the rounded-full pill pattern from quiz/setup). Selected = `border-primary bg-primary bg-primary text-primary-foreground`.
- Category filter (optional): `<select>` with first option "すべて". Options built from `CATEGORIES`, plus indented sub-category entries   `ボルドー` etc. (value encoded as `category` or `category|subcategory`).
- Primary button: "10問スタート" — disabled until ≥1 tag selected.
- Error/empty states inline.

**Fetch logic:**

```
supabase.from("questions")
  .select("id")
  .overlaps("tags", selectedTags)
  .eq("category", cat)            // only if specified
  .eq("subcategory", subcat)      // only if specified
  .limit(50)
```

RLS handles `user_id = auth.uid()`. Then client-shuffle, take 10 ids.

**Hand-off to existing quiz flow:** Save to `quizSession` with `mode: "quiz"` and `navigate({ to: "/quiz/run" })`. No changes needed to run/summary — answer_logs already get `mode: 'quiz'`.

**Accept query params** so the dashboard row-tap can deep-link & auto-start:

- `?tag=品種&autostart=1` → on mount, pre-select that tag; if `autostart=1`, immediately run the fetch + navigate.

Use `Route.useSearch()` with a `validateSearch` for `{ tag?: string; autostart?: '0'|'1' }`.

### 2. Dashboard additions — `src/routes/_authenticated.index.tsx`

Two new sections below the existing CTAs (the current home has no "Category Accuracy" section — I'll add the Tag Accuracy section as specified; mention to user that the referenced "Category Accuracy" section doesn't exist yet and we're adding Tag Accuracy below the SRS cards).

**Tag Accuracy section:**

- Heading: "タグ別正答率"
- Query: `supabase.from("tag_stats" as any).select("tag,total_answers,correct_rate").order("correct_rate", { ascending: true, nullsFirst: false })`. RLS scopes to user.
- Cast through `as any` because `tag_stats` view isn't in the generated `Database` types (types.ts is auto-generated from a different project and is read-only).
- Render each row as a tappable `<Link to="/drill" search={{ tag: row.tag, autostart: '1' }}>`:
  - Left: tag label
  - Right: `XX%` (rounded) + small `n=NN` muted
  - Background: gradient color computed from `correct_rate`:
    - `<0.5` → red tint (`bg-red-500/15 border-red-500/40`)
    - `0.5–0.8` → amber (`bg-amber-500/15 border-amber-500/40`)
    - `≥0.8` → green (`bg-emerald-500/15 border-emerald-500/40`)
  - If `total_answers < 5`: gray (`bg-muted text-muted-foreground opacity-60`), label `"n<5(計測不可)"`, row remains tappable.

### 3. Navigation

Add a tertiary CTA on the home page card stack:

```
<Button asChild variant="outline"><Link to="/drill">タグ横断演習</Link></Button>
```

Place between "クイズを始める" and "SRS復習". No global navbar exists today, so this is the natural entry point. Also add a small "← 戻る" link in `/drill` header back to `/`.

### Files


| File                                  | Action                                             |
| ------------------------------------- | -------------------------------------------------- |
| `src/routes/_authenticated.drill.tsx` | **create**                                         |
| `src/routes/_authenticated.index.tsx` | edit — add Tag Drill button + Tag Accuracy section |


### Technical notes

- `tag_stats` view not in `Database` types → use `from("tag_stats" as any)` and explicitly type the row shape locally:
  ```ts
  type TagStat = { tag: string; total_answers: number; correct_rate: number | null };
  ```
- `validateSearch` for `/drill` must be defined to accept `tag` and `autostart`.
- Auto-start path: on mount, if `searchParams.tag && autostart === '1'`, run the same fetch fn used by the button with `selectedTags=[tag]`, no category, then navigate to `/quiz/run`. Show a "準備中..." spinner during this.
- Reuse existing color tokens; avoid hardcoded hexes outside the gradient tint utilities.
- No DB migrations, no new tables, no edits to read-only files (`types.ts`, `client.ts`, `routeTree.gen.ts`).
- Good plan overall. A few refinements:

1. Question fetching: match the existing /quiz/setup flow — use select("*") 

   (or whatever columns the current quiz flow expects), not select("id"). 

   Avoid a two-round trip.

&nbsp;

2. Autostart empty-result handling: if the fetch returns 0 questions, stay 

   on /drill and show "該当する問題がありません" inline. Do not leave users 

   stuck on a spinner.

&nbsp;

3. Adjust color thresholds for correct_rate to match the exam passing line:

   - <0.6 → red

   - 0.6-0.75 → amber  

   - ≥0.75 → green

&nbsp;

4. For rows with total_answers < 5: keep the muted styling but add a small 

   → chevron on the right to indicate tappability.

&nbsp;

5. Confirm that adding a third CTA ("タグ横断演習") to the home card stack 

   renders well on mobile. If it gets cramped, use size="sm" for the drill 

   button specifically.

&nbsp;

Otherwise the plan is approved — proceed.