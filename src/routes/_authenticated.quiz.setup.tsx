import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, SUBCATEGORIES } from "@/constants/categories";
import { TAGS } from "@/constants/tags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { quizSession, type AnswerRecord } from "@/lib/quiz-session";

type QuizSetupSearch = { category?: string };

export const Route = createFileRoute("/_authenticated/quiz/setup")({
  validateSearch: (search: Record<string, unknown>): QuizSetupSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: QuizSetupPage,
});

type Order = "random" | "unanswered" | "wrong";
type QuestionType = "multiple_choice" | "fill_blank" | "flashcard";

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "クイズ" },
  { value: "fill_blank", label: "穴埋め" },
  { value: "flashcard", label: "カード" },
];

function QuizSetupPage() {
  const navigate = useNavigate();
  const { category: initialCategory } = Route.useSearch();
  const [category, setCategory] = useState<string>(
    initialCategory && (CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : CATEGORIES[0],
  );
  const [subcategory, setSubcategory] = useState<string>("");
  const [difficulties, setDifficulties] = useState<number[]>([1, 2, 3]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [count, setCount] = useState<1 | 10 | 20>(10);
  const [order, setOrder] = useState<Order>("random");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcats = useMemo(() => SUBCATEGORIES[category] ?? [], [category]);

  useEffect(() => {
    setSubcategory("");
  }, [category]);

  const toggleDifficulty = (d: number) => {
    setDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const toggleTag = (t: string) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const onStart = async () => {
    if (difficulties.length === 0) {
      setError("難易度を1つ以上選択してください");
      return;
    }
    setError(null);
    setSubmitting(true);

    let q = (supabase as any)
      .from("questions")
      .select("id, correct_count, wrong_count")
      .eq("category", category)
      .eq("question_type", questionType)
      .eq("is_archived", false)
      .in("difficulty", difficulties);

    if (subcats.length > 0 && subcategory) {
      q = q.eq("subcategory", subcategory);
    }
    if (selectedTags.length > 0) {
      q = q.overlaps("tags", selectedTags);
    }

    const { data, error: err } = await q;
    setSubmitting(false);

    if (err) {
      setError("問題の取得に失敗しました");
      return;
    }
    if (!data || data.length === 0) {
      setError("該当する問題がありません");
      return;
    }

    let rows = [...data];
    if (order === "random") {
      rows.sort(() => Math.random() - 0.5);
    } else if (order === "unanswered") {
      rows.sort((a, b) => {
        const aAns = (a.correct_count ?? 0) + (a.wrong_count ?? 0);
        const bAns = (b.correct_count ?? 0) + (b.wrong_count ?? 0);
        if (aAns !== bAns) return aAns - bAns;
        return Math.random() - 0.5;
      });
    } else {
      rows.sort((a, b) => {
        const aW = a.wrong_count ?? 0;
        const bW = b.wrong_count ?? 0;
        if (aW !== bW) return bW - aW;
        return Math.random() - 0.5;
      });
    }

    const ids = rows.slice(0, count).map((r) => r.id);

    quizSession.save({
      questionIds: ids,
      currentIndex: 0,
      answers: [] as AnswerRecord[],
      mode: "quiz",
      startedAt: new Date().toISOString(),
    });

    navigate({ to: "/quiz/run" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 戻る
        </Link>
        <h1 className="text-lg font-semibold">クイズ設定</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="space-y-2">
          <Label className="text-base">カテゴリ</Label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {subcats.length > 0 && (
          <div className="space-y-2">
            <Label className="text-base">サブカテゴリ</Label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
            >
              <option value="">すべて</option>
              {subcats.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-base">問題形式</Label>
          <div className="flex gap-2">
            {QUESTION_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setQuestionType(opt.value)}
                className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                  questionType === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">難易度</Label>
          <div className="flex gap-2">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDifficulty(d)}
                className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                  difficulties.includes(d)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">タグ(任意)</Label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                  selectedTags.includes(t)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">問題数</Label>
          <div className="flex gap-2">
            {[1, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n as 1 | 10)}
                className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                  count === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {n}問
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-base">出題順</Label>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as Order)}
            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
          >
            <option value="random">ランダム</option>
            <option value="unanswered">未回答優先</option>
            <option value="wrong">誤答多い順</option>
          </select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={onStart}
          disabled={submitting}
          className="h-14 w-full text-base font-medium"
        >
          {submitting ? "準備中..." : "開始"}
        </Button>
      </main>
    </div>
  );
}
