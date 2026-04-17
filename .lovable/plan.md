

User locked in 4 adjustments. All clear, no ambiguity. Just confirm the revised plan concisely.

# Wine Master — Revised Build Plan (Confirmed)

All 4 adjustments accepted. Here's the locked plan.

## Adjustments incorporated

1. **34 categories**: hardcoded constant in `src/constants/categories.ts` using the exact Japanese strings provided. Subcategories also hardcoded (フランス: 8, イタリア: 3).
2. **Tags**: hardcoded constant in `src/constants/tags.ts` (8 tags). No DB distinct query.
3. **SRS queue ordering**:
   - Set A — Overdue (`next_review_at <= now()`), ordered by `next_review_at` ASC
   - Set B — Starred backlog (`is_starred = true` AND NOT in A), ordered by `last_reviewed_at` ASC NULLS FIRST
   - Final = A ++ B
4. **Session persistence**:
   - `/quiz/run` reads/writes `sessionStorage["wine-master:active-quiz"]`
   - `/srs/run` reads/writes `sessionStorage["wine-master:active-srs"]`
   - Hydrate on mount; redirect to setup (or home for SRS) if absent; clear on summary

## Build order (Phase 1)

1. Supabase client + auth context (env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
2. `/login` — JP labels, login-only
3. `_authenticated` pathless layout route guard
4. `/` — header, SRS due count card, two primary buttons
5. `src/constants/categories.ts` + `src/constants/tags.ts`
6. `/quiz/setup` → `/quiz/run` → summary (with sessionStorage persistence + 「間違えた問題だけもう一度」)
7. `/srs/run` → summary (with revised queue ordering + sessionStorage)

## Phase 2 (after Phase 1 verified)

- Category accuracy list on Home
- `/questions` browser

## Design tokens

Warm off-white bg, deep wine-red primary, muted gray secondary. Mobile-first, ≥48px tap targets, JP-friendly font stack & line-height. Subtle fades only.

## What I need at the start of build mode

1. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Confirmation that 5–10 sample `questions` rows are inserted

Approve and I'll switch to build mode.

