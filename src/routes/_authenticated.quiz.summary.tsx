import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { quizSession } from "@/lib/quiz-session";

export const Route = createFileRoute("/_authenticated/quiz/summary")({
  component: QuizSummaryPage,
});

interface QRow {
  id: string;
  question_text: string;
}

function QuizSummaryPage() {
  const navigate = useNavigate();
  const [session] = useState(() => quizSession.load());
  const [wrongQuestions, setWrongQuestions] = useState<QRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate({ to: "/quiz/setup" });
      return;
    }
    const wrongIds = session.answers.filter((a) => !a.isCorrect).map((a) => a.questionId);
    if (wrongIds.length === 0) {
      setWrongQuestions([]);
      setLoaded(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("questions")
        .select("id, question_text")
        .in("id", wrongIds);
      setWrongQuestions(data ?? []);
      setLoaded(true);
    })();
  }, [session, navigate]);

  // Clear session on unmount when leaving summary
  useEffect(() => {
    return () => {
      // Cleared explicitly via actions below; do not auto-clear so refresh works
    };
  }, []);

  if (!session) return null;

  const total = session.answers.length;
  const correct = session.answers.filter((a) => a.isCorrect).length;
  const wrongIds = session.answers.filter((a) => !a.isCorrect).map((a) => a.questionId);

  const onRetryWrong = () => {
    if (wrongIds.length === 0) return;
    quizSession.save({
      questionIds: wrongIds,
      currentIndex: 0,
      answers: [],
      mode: "quiz",
      startedAt: new Date().toISOString(),
    });
    navigate({ to: "/quiz/run" });
  };

  const onHome = () => {
    quizSession.clear();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-5 py-4">
        <h1 className="text-lg font-semibold">結果</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">スコア</p>
          <p className="mt-2 text-5xl font-bold text-primary tabular-nums">
            {correct}
            <span className="text-2xl text-muted-foreground"> / {total}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            正答率 {total > 0 ? Math.round((correct / total) * 100) : 0}%
          </p>
        </div>

        {loaded && wrongQuestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">間違えた問題</p>
            <ul className="space-y-2">
              {wrongQuestions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-xl border bg-card p-3 text-sm leading-relaxed text-foreground"
                >
                  {q.question_text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {wrongIds.length > 0 && (
            <Button onClick={onRetryWrong} className="h-14 w-full text-base font-medium">
              間違えた問題だけもう一度
            </Button>
          )}
          <Button
            onClick={onHome}
            variant="outline"
            className="h-14 w-full text-base font-medium"
          >
            ホームへ戻る
          </Button>
        </div>
      </main>
    </div>
  );
}
