import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { quizSession, type AnswerRecord } from "@/lib/quiz-session";
import { Star } from "lucide-react";
import { FlagButton } from "@/components/quiz/FlagButton";

export const Route = createFileRoute("/_authenticated/quiz/run")({
  component: QuizRunPage,
});

interface Question {
  id: string;
  question_text: string;
  options: string[];
  answer_index: number;
  explanation: string;
  is_starred: boolean;
  srs_stage: number;
  correct_count: number;
  wrong_count: number;
}

function QuizRunPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState(() => quizSession.load());
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/quiz/setup" });
      return;
    }
    if (session.currentIndex >= session.questionIds.length) {
      navigate({ to: "/quiz/summary" });
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
          "id, question_text, options, answer_index, explanation, is_starred, srs_stage, correct_count, wrong_count",
        )
        .eq("id", qid)
        .single();
      if (cancelled) return;
      if (error || !data) {
        console.error("question fetch error", error);
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

  if (!session) return null;

  const total = session.questionIds.length;
  const progress = session.currentIndex + 1;

  const onSelect = async (idx: number) => {
    if (revealed || !question || !user) return;
    setSelected(idx);
    setRevealed(true);

    const isCorrect = idx === question.answer_index;

    // Log answer
    await supabase.from("answer_logs").insert({
      user_id: user.id,
      question_id: question.id,
      is_correct: isCorrect,
      selected_index: idx,
      selected_text: question.options[idx] ?? null,
      mode: "quiz",
    });

    // Update question counters + auto-enqueue into SRS on first wrong
    if (isCorrect) {
      await supabase
        .from("questions")
        .update({ correct_count: (question.correct_count ?? 0) + 1 })
        .eq("id", question.id);
    } else {
      const isFirstWrong = (question.wrong_count ?? 0) === 0;
      // Always increment wrong_count
      await supabase
        .from("questions")
        .update({ wrong_count: (question.wrong_count ?? 0) + 1 })
        .eq("id", question.id);
      // Auto-enqueue into SRS on first-ever wrong, only if not already queued
      if (isFirstWrong) {
        const next = new Date();
        next.setDate(next.getDate() + 3);
        await supabase
          .from("questions")
          .update({
            srs_stage: 1,
            next_review_at: next.toISOString(),
          })
          .eq("id", question.id)
          .is("next_review_at", null);
      }
    }

    // Update session
    const newAnswer: AnswerRecord = {
      questionId: question.id,
      selectedIndex: idx,
      isCorrect,
    };
    const updated = { ...session, answers: [...session.answers, newAnswer] };
    quizSession.save(updated);
    setSession(updated);
  };

  const onNext = () => {
    if (!session) return;
    const updated = { ...session, currentIndex: session.currentIndex + 1 };
    quizSession.save(updated);
    setSession(updated);
  };

  const onToggleStar = async () => {
    if (!question) return;
    const newVal = !starred;
    setStarred(newVal);
    await supabase.from("questions").update({ is_starred: newVal }).eq("id", question.id);
    // Auto-enqueue into SRS when starring on, only if not already queued.
    // Toggling off does NOT remove from the queue.
    if (newVal) {
      const next = new Date();
      next.setDate(next.getDate() + 3);
      await supabase
        .from("questions")
        .update({
          srs_stage: 1,
          next_review_at: next.toISOString(),
        })
        .eq("id", question.id)
        .is("next_review_at", null);
    }
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
          {progress} / {total}
        </span>
        <div className="flex items-center gap-1">
          <FlagButton questionId={question.id} />
          <button
            onClick={onToggleStar}
            aria-label="スター切り替え"
            className="p-2"
          >
            <Star
              className={`h-6 w-6 ${starred ? "fill-primary text-primary" : "text-muted-foreground"}`}
            />
          </button>
        </div>
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
            <Button onClick={onNext} className="h-14 w-full text-base font-medium">
              {progress < total ? "次へ" : "結果を見る"}
            </Button>
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
