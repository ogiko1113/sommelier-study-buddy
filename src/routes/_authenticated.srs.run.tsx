import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { srsSession, type SrsAnswerRecord } from "@/lib/quiz-session";
import { applySrsRating, type SrsRating } from "@/lib/srs";
import { Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/srs/run")({
  component: SrsRunPage,
});

interface Question {
  id: string;
  question_text: string;
  options: string[];
  answer_index: number;
  explanation: string;
  is_starred: boolean;
  srs_stage: number;
}

function SrsRunPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(() => srsSession.load());
  const [bootstrapping, setBootstrapping] = useState(!srsSession.load());
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [starred, setStarred] = useState(false);

  // Build queue if no active session — strict spec query, limit 20
  useEffect(() => {
    if (session || !user) return;
    let cancelled = false;
    (async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("questions")
        .select("id")
        .not("next_review_at", "is", null)
        .lte("next_review_at", nowIso)
        .lt("srs_stage", 5)
        .order("next_review_at", { ascending: true })
        .limit(20);
      if (cancelled) return;
      if (error) {
        console.error("srs queue error", error);
        navigate({ to: "/" });
        return;
      }
      const queue = (data ?? []).map((r) => r.id);
      if (queue.length === 0) {
        navigate({ to: "/" });
        return;
      }
      const newSession = {
        questionIds: queue,
        currentIndex: 0,
        answers: [] as SrsAnswerRecord[],
        mode: "srs_review" as const,
        startedAt: new Date().toISOString(),
      };
      srsSession.save(newSession);
      setSession(newSession);
      setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, user, navigate]);

  useEffect(() => {
    if (!session) return;
    if (session.currentIndex >= session.questionIds.length) {
      navigate({ to: "/srs/summary" });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session || session.currentIndex >= session.questionIds.length) return;
    const qid = session.questionIds[session.currentIndex];
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    setRevealed(false);
    (async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, question_text, options, answer_index, explanation, is_starred, srs_stage",
        )
        .eq("id", qid)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      const q: Question = {
        ...data,
        options: Array.isArray(data.options) ? (data.options as string[]) : [],
      };
      setQuestion(q);
      setStarred(q.is_starred);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.currentIndex, session?.questionIds]);

  if (bootstrapping || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">復習キューを準備中...</p>
      </div>
    );
  }

  const total = session.questionIds.length;
  const progress = session.currentIndex + 1;

  const onSelect = (idx: number) => {
    if (revealed || !question) return;
    setSelected(idx);
    setRevealed(true);
  };

  const onRate = async (rating: SrsRating) => {
    if (!question || !user || selected === null) return;
    // Spec: is_correct = true ONLY when rating is "perfect"
    const isCorrect = rating === "perfect";

    const update = applySrsRating(question.srs_stage, rating);

    await supabase.from("answer_logs").insert({
      user_id: user.id,
      question_id: question.id,
      is_correct: isCorrect,
      selected_index: selected,
      selected_text: question.options[selected] ?? null,
      srs_rating: rating,
      mode: "srs_review",
    });

    await supabase
      .from("questions")
      .update({
        srs_stage: update.srs_stage,
        next_review_at: update.next_review_at,
        last_reviewed_at: update.last_reviewed_at,
      })
      .eq("id", question.id);

    const newAnswer: SrsAnswerRecord = {
      questionId: question.id,
      selectedIndex: selected,
      isCorrect,
      rating,
    };
    const updated = {
      ...session,
      currentIndex: session.currentIndex + 1,
      answers: [...session.answers, newAnswer],
    };
    srsSession.save(updated);
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
          SRS {progress} / {total}
        </span>
        <button onClick={onToggleStar} aria-label="スター切り替え" className="p-2">
          <Star
            className={`h-6 w-6 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`}
          />
        </button>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-lg leading-relaxed text-foreground">{question.question_text}</p>
        </div>

        <div className="space-y-3">
          {question.options.map((opt, idx) => {
            const isCorrect = idx === question.answer_index;
            const isSelected = idx === selected;
            let cls = "border-input bg-card text-foreground hover:bg-accent";
            if (revealed) {
              if (isCorrect) {
                cls = "border-primary bg-primary/10 text-foreground";
              } else if (isSelected) {
                cls = "border-muted-foreground/40 bg-muted text-muted-foreground";
              } else {
                cls = "border-input bg-card text-muted-foreground opacity-60";
              }
            }
            return (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                disabled={revealed}
                className={`flex min-h-14 w-full items-center rounded-xl border px-4 py-3 text-left text-base leading-relaxed transition-colors ${cls}`}
              >
                <span className="mr-3 font-semibold tabular-nums">{idx + 1}.</span>
                <span className="flex-1">{opt}</span>
                {revealed && isCorrect && <span className="ml-2 text-primary">○</span>}
                {revealed && isSelected && !isCorrect && (
                  <span className="ml-2 text-muted-foreground">×</span>
                )}
              </button>
            );
          })}
        </div>

        {revealed && (
          <>
            <div className="rounded-xl border bg-accent/40 p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">解説</p>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {question.explanation || "(解説なし)"}
              </p>
            </div>
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
              <Button
                onClick={() => onRate("perfect")}
                className="h-14 text-sm font-medium"
              >
                完璧
              </Button>
            </div>
          </>
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
