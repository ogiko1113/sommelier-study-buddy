import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cardsSession } from "@/lib/quiz-session";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/cards/summary")({
  component: CardsSummaryPage,
});

function CardsSummaryPage() {
  const navigate = useNavigate();
  const [session] = useState(() => cardsSession.load());
  const [reviewQuestions, setReviewQuestions] = useState<
    { id: string; card_front: string; rating: "vague" | "unknown" }[] | null
  >(null);

  const reviewItems = session
    ? session.answers.filter((a) => a.rating === "vague" || a.rating === "unknown")
    : [];

  useEffect(() => {
    if (!session) return;
    if (reviewItems.length === 0) {
      setReviewQuestions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = reviewItems.map((r) => r.questionId);
      const { data, error } = await (supabase as any)
        .from("questions")
        .select("id, card_front")
        .in("id", ids);
      if (cancelled) return;
      if (error || !data) {
        setReviewQuestions([]);
        return;
      }
      const ratingById = new Map(reviewItems.map((r) => [r.questionId, r.rating]));
      setReviewQuestions(
        (data as { id: string; card_front: string | null }[]).map((q) => ({
          id: q.id,
          card_front: q.card_front ?? "",
          rating: ratingById.get(q.id) as "vague" | "unknown",
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) {
    navigate({ to: "/" });
    return null;
  }

  const total = session.answers.length;
  const perfectCount = session.answers.filter((a) => a.rating === "perfect").length;
  const vagueCount = session.answers.filter((a) => a.rating === "vague").length;
  const unknownCount = session.answers.filter((a) => a.rating === "unknown").length;

  const onHome = () => {
    cardsSession.clear();
    navigate({ to: "/" });
  };

  const onAgain = () => {
    cardsSession.clear();
    navigate({ to: "/cards/setup" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-5 py-4">
        <h1 className="text-lg font-semibold">フラッシュカード 完了</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">スコア</p>
          <p className="mt-2 text-5xl font-bold text-primary tabular-nums">
            {perfectCount} <span className="text-2xl text-muted-foreground">/ {total}</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground tabular-nums">
            完璧 {perfectCount} / うろ覚え {vagueCount} / わからない {unknownCount}
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">復習が必要なカード</h2>
          {reviewQuestions === null ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : reviewQuestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">お疲れ様でした。すべて完璧です。</p>
          ) : (
            <ul className="space-y-2">
              {reviewQuestions.map((q) => (
                <li key={q.id} className="rounded-lg border bg-card px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        q.rating === "unknown"
                          ? "bg-red-500/15 text-red-700 dark:text-red-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {q.rating === "unknown" ? "わからない" : "うろ覚え"}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {q.card_front}
                  </p>
                  <Link
                    to="/editor/$id"
                    params={{ id: q.id }}
                    className="mt-2 inline-block text-xs text-muted-foreground underline"
                  >
                    エディタで開く
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-2">
          <Button onClick={onAgain} variant="outline" className="h-12 text-sm font-medium">
            もう一度やる
          </Button>
          <Button onClick={onHome} className="h-14 w-full text-base font-medium">
            ホームへ戻る
          </Button>
        </div>
      </main>
    </div>
  );
}
