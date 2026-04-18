import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, SUBCATEGORIES } from "@/constants/categories";
import { TAGS } from "@/constants/tags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cardsSession, type CardAnswerRecord } from "@/lib/quiz-session";

type CardsSetupSearch = { category?: string };

export const Route = createFileRoute("/_authenticated/cards/setup")({
  validateSearch: (search: Record<string, unknown>): CardsSetupSearch => ({
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: CardsSetupPage,
});

type Order = "random" | "oldest_review" | "newest";

function CardsSetupPage() {
  const navigate = useNavigate();
  const { category: initialCategory } = Route.useSearch();
  const [category, setCategory] = useState<string>(
    initialCategory && (CATEGORIES as readonly string[]).includes(initialCategory)
      ? initialCategory
      : CATEGORIES[0],
  );
  const [allCategories, setAllCategories] = useState(false);
  const [subcategory, setSubcategory] = useState<string>("");
  const [difficulties, setDifficulties] = useState<number[]>([1, 2, 3]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [count, setCount] = useState<10 | 20 | 50>(20);
  const [order, setOrder] = useState<Order>("random");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcats = useMemo(
    () => (allCategories ? [] : SUBCATEGORIES[category] ?? []),
    [allCategories, category],
  );

  useEffect(() => {
    setSubcategory("");
  }, [category, allCategories]);

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
      .select("id, last_reviewed_at, created_at")
      .eq("question_type", "flashcard")
      .eq("is_archived", false)
      .in("difficulty", difficulties);

    if (!allCategories) {
      q = q.eq("category", category);
      if (subcats.length > 0 && subcategory) {
        q = q.eq("subcategory", subcategory);
      }
    }
    if (selectedTags.length > 0) {
      q = q.overlaps("tags", selectedTags);
    }

    const { data, error: err } = await q;
    setSubmitting(false);

    if (err) {
      setError(`カードの取得に失敗しました: ${err.message}`);
      return;
    }
    if (!data || data.length === 0) {
      setError("該当するカードがありません");
      return;
    }

    let rows = [...data];
    if (order === "random") {
      rows.sort(() => Math.random() - 0.5);
    } else if (order === "oldest_review") {
      // null (never reviewed) first, then oldest last_reviewed_at
      rows.sort((a, b) => {
        const aT = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
        const bT = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
        return aT - bT;
      });
    } else {
      rows.sort((a, b) => {
        const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bT - aT;
      });
    }

    const ids = rows.slice(0, count).map((r) => r.id);

    cardsSession.save({
      questionIds: ids,
      currentIndex: 0,
      answers: [] as CardAnswerRecord[],
      mode: "cards",
      startedAt: new Date().toISOString(),
    });

    navigate({ to: "/cards/run" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 戻る
        </Link>
        <h1 className="text-lg font-semibold">フラッシュカード設定</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="space-y-2">
          <Label className="text-base">カテゴリ</Label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllCategories((v) => !v)}
              className={`h-12 rounded-md border px-4 text-sm transition-colors ${
                allCategories
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-foreground"
              }`}
            >
              すべて
            </button>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={allCategories}
              className="h-12 flex-1 rounded-md border border-input bg-card px-3 text-base disabled:opacity-50"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!allCategories && subcats.length > 0 && (
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
          <Label className="text-base">カード数</Label>
          <div className="flex gap-2">
            {([10, 20, 50] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`h-12 flex-1 rounded-md border text-base transition-colors ${
                  count === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground"
                }`}
              >
                {n}枚
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
            <option value="oldest_review">復習が古い順</option>
            <option value="newest">新しい順</option>
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
