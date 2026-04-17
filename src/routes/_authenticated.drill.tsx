import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, SUBCATEGORIES } from "@/constants/categories";
import { TAGS } from "@/constants/tags";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { quizSession, type AnswerRecord } from "@/lib/quiz-session";

type DrillSearch = {
  tag?: string;
  autostart?: "0" | "1";
};

export const Route = createFileRoute("/_authenticated/drill")({
  validateSearch: (search: Record<string, unknown>): DrillSearch => {
    const tag = typeof search.tag === "string" ? search.tag : undefined;
    const autostart = search.autostart === "1" || search.autostart === "0"
      ? (search.autostart as "0" | "1")
      : undefined;
    return { tag, autostart };
  },
  component: DrillPage,
});

// Build flat options: top-level categories, plus indented subcategories.
// Value encoding: "category" or "category|subcategory"
type CatOption = { value: string; label: string };
const CATEGORY_OPTIONS: CatOption[] = (() => {
  const out: CatOption[] = [];
  for (const c of CATEGORIES) {
    out.push({ value: c, label: c });
    const subs = SUBCATEGORIES[c];
    if (subs) {
      for (const s of subs) {
        out.push({ value: `${c}|${s}`, label: `\u3000${s}` });
      }
    }
  }
  return out;
})();

function DrillPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [selectedTags, setSelectedTags] = useState<string[]>(
    search.tag ? [search.tag] : [],
  );
  const [categoryValue, setCategoryValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoStarting, setAutoStarting] = useState(
    search.tag !== undefined && search.autostart === "1",
  );

  const toggleTag = (t: string) => {
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const runDrill = useCallback(
    async (tags: string[], catValue: string): Promise<{ ok: boolean; reason?: string }> => {
      let category: string | null = null;
      let subcategory: string | null = null;
      if (catValue) {
        const [c, s] = catValue.split("|");
        category = c;
        subcategory = s ?? null;
      }

      let q = supabase
        .from("questions")
        .select("id")
        .overlaps("tags", tags)
        .limit(50);

      if (category) q = q.eq("category", category);
      if (subcategory) q = q.eq("subcategory", subcategory);

      const { data, error: err } = await q;
      if (err) return { ok: false, reason: "問題の取得に失敗しました" };
      if (!data || data.length === 0) {
        return { ok: false, reason: "該当する問題がありません" };
      }

      const shuffled = [...data].sort(() => Math.random() - 0.5);
      const ids = shuffled.slice(0, 10).map((r) => r.id);

      quizSession.save({
        questionIds: ids,
        currentIndex: 0,
        answers: [] as AnswerRecord[],
        mode: "quiz",
        startedAt: new Date().toISOString(),
      });

      navigate({ to: "/quiz/run" });
      return { ok: true };
    },
    [navigate],
  );

  // Auto-start path from dashboard deep-link
  useEffect(() => {
    if (!autoStarting) return;
    let cancelled = false;
    (async () => {
      const result = await runDrill(search.tag ? [search.tag] : [], "");
      if (cancelled) return;
      if (!result.ok) {
        setAutoStarting(false);
        setError(result.reason ?? "問題の取得に失敗しました");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStart = async () => {
    if (selectedTags.length === 0) return;
    setError(null);
    setSubmitting(true);
    const result = await runDrill(selectedTags, categoryValue);
    if (!result.ok) {
      setError(result.reason ?? "問題の取得に失敗しました");
      setSubmitting(false);
    }
  };

  const canStart = useMemo(() => selectedTags.length > 0 && !submitting, [
    selectedTags.length,
    submitting,
  ]);

  if (autoStarting) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
          <Link to="/" className="text-sm text-muted-foreground">
            ← 戻る
          </Link>
          <h1 className="text-lg font-semibold">タグ横断演習</h1>
        </header>
        <main className="mx-auto max-w-md px-5 py-12 text-center">
          <p className="text-muted-foreground">準備中...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b bg-card px-5 py-4">
        <Link to="/" className="text-sm text-muted-foreground">
          ← 戻る
        </Link>
        <h1 className="text-lg font-semibold">タグ横断演習</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="space-y-2">
          <Label className="text-base">タグ(1つ以上選択)</Label>
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
          <Label className="text-base">カテゴリ(任意)</Label>
          <select
            value={categoryValue}
            onChange={(e) => setCategoryValue(e.target.value)}
            className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
          >
            <option value="">すべて</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={onStart}
          disabled={!canStart}
          className="h-14 w-full text-base font-medium"
        >
          {submitting ? "準備中..." : "10問スタート"}
        </Button>
      </main>
    </div>
  );
}
