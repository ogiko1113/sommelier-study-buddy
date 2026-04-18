import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { quizSession, type AnswerRecord } from "@/lib/quiz-session";
import { Star } from "lucide-react";
import { FlagButton } from "@/components/quiz/FlagButton";
import { QuestionImage } from "@/components/quiz/QuestionImage";
import { FillBlankRunner } from "@/components/quiz/FillBlankRunner";
import {
  scoreFillBlank,
  PARTIAL_CREDIT_THRESHOLD,
  type Blank,
} from "@/lib/fill-blank-judge";

export const Route = createFileRoute("/_authenticated/quiz/run")({
  component: QuizRunPage,
});

interface Question {
  id: string;
  question_type: string;
  question_text: string;
  options: string[];
  answer_index: number;
  explanation: string;
  is_starred: boolean;
  srs_stage: number;
  correct_count: number;
  wrong_count: number;
  image_url: string | null;
  input_mode: "text" | "select" | null;
  blanks: Blank[];
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
  // Fill-blank state
  const [fbInputs, setFbInputs] = useState<Record<number, string>>({});

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
    setFbInputs({});
    (async () => {
      const { data, error } = await (supabase as any)
        .from("questions")
        .select(
          "id, question_type, question_text, options, answer_index, explanation, is_starred, srs_stage, correct_count, wrong_count, image_url, input_mode, blanks",
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
        blanks: Array.isArray(data.blanks)
          ? (data.blanks as any[]).map((b) => ({
              index: Number(b.index),
              answer: String(b.answer ?? ""),
              accept: Array.isArray(b.accept) ? b.accept.map(String) : [],
              options: Array.isArray(b.options) ? b.options.map(String) : [],
            }))
          : [],
      };
      setQuestion(q);
      setStarred(q.is_starred);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.currentIndex, session?.questionIds]);

  const fbScore = useMemo(() => {
    if (!question || question.question_type !== "fill_blank") return null;
    return scoreFillBlank(fbInputs, question.blanks);
  }, [fbInputs, question]);

  const allFilled = useMemo(() => {
    if (!question || question.question_type !== "fill_blank") return false;
    return question.blanks.every(
      (b) => (fbInputs[b.index] ?? "").trim().length > 0,
    );
  }, [fbInputs, question]);

  if (!session) return null;

  const total = session.questionIds.length;
  const progress = session.currentIndex + 1;

  const onSelect = async (idx: number) => {
    if (revealed || !question || !user) return;
    setSelected(idx);
    setRevealed(true);

    const isCorrect = idx === question.answer_index;
    await recordAnswer(isCorrect, {
      selected_index: idx,
      selected_text: question.options[idx] ?? null,
    });
  };

  const onSubmitFillBlank = async () => {
    if (revealed || !question || !user || !fbScore) return;
    setRevealed(true);
    const isCorrect = fbScore.ratio >= PARTIAL_CREDIT_THRESHOLD;
    await recordAnswer(isCorrect, {
      selected_index: null,
      selected_text: JSON.stringify(fbInputs),
    });
  };

  const recordAnswer = async (
    isCorrect: boolean,
    payload: { selected_index: number | null; selected_text: string | null },
  ) => {
    if (!question || !user) return;
    await supabase.from("answer_logs").insert({
      user_id: user.id,
      question_id: question.id,
      is_correct: isCorrect,
      selected_index: payload.selected_index,
      selected_text: payload.selected_text,
      mode: "quiz",
    });

    if (isCorrect) {
      await supabase
        .from("questions")
        .update({ correct_count: (question.correct_count ?? 0) + 1 })
        .eq("id", question.id);
    } else {
      const isFirstWrong = (question.wrong_count ?? 0) === 0;
      await supabase
        .from("questions")
        .update({ wrong_count: (question.wrong_count ?? 0) + 1 })
        .eq("id", question.id);
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

    const newAnswer: AnswerRecord = {
      questionId: question.id,
      selectedIndex: payload.selected_index ?? -1,
      isCorrect,
    };
    if (!session) return;
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

  const isFill = question.question_type === "fill_blank";

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="flex items-center justify-between border-b bg-card px-5 py-4">
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          {progress} / {total}
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

        {isFill ? (
          <>
            <FillBlankRunner
              questionText={question.question_text}
              blanks={question.blanks}
              inputMode={question.input_mode ?? "text"}
              inputs={fbInputs}
              onChange={(idx, value) =>
                setFbInputs((prev) => ({ ...prev, [idx]: value }))
              }
              revealed={revealed}
              perBlank={fbScore?.perBlank}
            />

            {!revealed && (
              <Button
                onClick={onSubmitFillBlank}
                disabled={!allFilled}
                className="h-14 w-full text-base font-medium"
              >
                答え合わせ
              </Button>
            )}

            {revealed && fbScore && (
              <div className="rounded-xl border bg-accent/40 p-4 text-center">
                <p className="text-base font-semibold tabular-nums">
                  {fbScore.correctCount} / {fbScore.total} 正解
                </p>
                <p className="text-xs text-muted-foreground">
                  {fbScore.ratio >= PARTIAL_CREDIT_THRESHOLD
                    ? "正解扱い (80% 以上)"
                    : "不正解扱い"}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
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
          </>
        )}

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
