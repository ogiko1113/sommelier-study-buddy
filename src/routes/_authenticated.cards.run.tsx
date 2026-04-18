import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cardsSession, type CardAnswerRecord } from "@/lib/quiz-session";
import { applySrsRating, type SrsRating } from "@/lib/srs";
import { Star } from "lucide-react";
import { FlagButton } from "@/components/quiz/FlagButton";
import { QuestionImage } from "@/components/quiz/QuestionImage";

export const Route = createFileRoute("/_authenticated/cards/run")({
  component: CardsRunPage,
});

interface CardQuestion {
  id: string;
  card_front: string | null;
  card_back: string | null;
  explanation: string;
  is_starred: boolean;
  srs_stage: number;
  image_url: string | null;
}

function CardsRunPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(() => cardsSession.load());
  const [question, setQuestion] = useState<CardQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/cards/setup" });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session) return;
    if (session.currentIndex >= session.questionIds.length) {
      navigate({ to: "/cards/summary" });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session || session.currentIndex >= session.questionIds.length) return;
    const qid = session.questionIds[session.currentIndex];
    let cancelled = false;
    setLoading(true);
    setFlipped(false);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("questions")
        .select(
          "id, card_front, card_back, explanation, is_starred, srs_stage, image_url",
        )
        .eq("id", qid)
        .single();
      if (cancelled) return;
      if (error || !data) {
        console.error("card load error", error);
        setLoading(false);
        return;
      }
      setQuestion(data as CardQuestion);
      setStarred(!!data.is_starred);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.currentIndex, session?.questionIds]);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">準備中...</p>
      </div>
    );
  }

  const total = session.questionIds.length;
  const progress = session.currentIndex + 1;

  const onRate = async (rating: SrsRating) => {
    if (!question || !user) return;
    const isCorrect = rating === "perfect";
    const update = applySrsRating(question.srs_stage, rating);

    await supabase.from("answer_logs").insert({
      user_id: user.id,
      question_id: question.id,
      is_correct: isCorrect,
      selected_index: null,
      selected_text: null,
      srs_rating: rating,
      mode: "cards",
    });

    await supabase
      .from("questions")
      .update({
        srs_stage: update.srs_stage,
        next_review_at: update.next_review_at,
        last_reviewed_at: update.last_reviewed_at,
      })
      .eq("id", question.id);

    const newAnswer: CardAnswerRecord = {
      questionId: question.id,
      rating,
    };
    const updated = {
      ...session,
      currentIndex: session.currentIndex + 1,
      answers: [...session.answers, newAnswer],
    };
    cardsSession.save(updated);
    setSession(updated);
  };

  const onToggleStar = async () => {
    if (!question) return;
    const newVal = !starred;
    setStarred(newVal);
    await supabase.from("questions").update({ is_starred: newVal }).eq("id", question.id);
  };

  if (loading || !question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="flex items-center justify-between border-b bg-card px-5 py-4">
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          カード {progress} / {total}
        </span>
        <div className="flex items-center gap-1">
          <FlagButton questionId={question.id} />
          <button onClick={onToggleStar} aria-label="スター切り替え" className="p-2">
            <Star
              className={`h-6 w-6 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        {question.image_url && <QuestionImage url={question.image_url} />}

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="block w-full"
          aria-label={flipped ? "表面に戻す" : "裏面を見る"}
        >
          <div
            className={`min-h-[240px] rounded-2xl border-2 p-6 text-left shadow-sm transition-colors ${
              flipped
                ? "border-primary/50 bg-primary/5"
                : "border-input bg-card hover:bg-accent/40"
            }`}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {flipped ? "裏面" : "表面 — タップで裏面を表示"}
            </p>
            <p className="text-xl leading-relaxed text-foreground whitespace-pre-wrap">
              {flipped ? question.card_back ?? "(裏面なし)" : question.card_front ?? "(表面なし)"}
            </p>
          </div>
        </button>

        {flipped && question.explanation && (
          <div className="rounded-xl border bg-accent/40 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">補足</p>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {question.explanation}
            </p>
          </div>
        )}

        {flipped && (
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => onRate("unknown")}
              variant="outline"
              className="h-14 text-sm font-medium"
            >
              わからない
            </Button>
            <Button
              onClick={() => onRate("vague")}
              variant="outline"
              className="h-14 text-sm font-medium"
            >
              うろ覚え
            </Button>
            <Button onClick={() => onRate("perfect")} className="h-14 text-sm font-medium">
              完璧
            </Button>
          </div>
        )}

        <div className="pt-2 text-center">
          <Link to="/" className="text-xs text-muted-foreground">
            中断してホームへ
          </Link>
        </div>
      </main>
    </div>
  );
}
