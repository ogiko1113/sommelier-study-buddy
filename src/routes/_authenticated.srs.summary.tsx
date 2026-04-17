import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { srsSession } from "@/lib/quiz-session";

export const Route = createFileRoute("/_authenticated/srs/summary")({
  component: SrsSummaryPage,
});

function SrsSummaryPage() {
  const navigate = useNavigate();
  const [session] = useState(() => srsSession.load());

  if (!session) {
    navigate({ to: "/" });
    return null;
  }

  const total = session.answers.length;
  const correct = session.answers.filter((a) => a.isCorrect).length;

  const onHome = () => {
    srsSession.clear();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-5 py-4">
        <h1 className="text-lg font-semibold">SRS復習 完了</h1>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-5 py-6">
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">復習問題数</p>
          <p className="mt-2 text-5xl font-bold text-primary tabular-nums">{total}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            正解 {correct} / {total}
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground">お疲れ様でした。</p>
        <Button onClick={onHome} className="h-14 w-full text-base font-medium">
          ホームへ戻る
        </Button>
      </main>
    </div>
  );
}
